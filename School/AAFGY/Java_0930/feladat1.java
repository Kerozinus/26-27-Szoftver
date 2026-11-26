import java.util.Scanner;
public class feladat1{
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Kérlek adj meg egy számot: ");
        int szam1 = sc.nextInt();
        System.out.print("Kérlek adj meg még egy számot: ");
        int szam2  = sc.nextInt();
        System.out.println("A megadott két számod összege: "+(szam1+szam2));
    }
}
import java.util.Scanner;
public class feladat3{
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Adj meg egy számot: ");
        int szam1 = sc.nextInt();
        System.out.print("Adj meg még egy számot: ");
        int szam2 = sc.nextInt();
        System.out.println("Összegük: "+(szam1+szam2));
        System.out.println("Különbség: "+(szam1-szam2));
        System.out.println("Szorzata: "+(szam1*szam2));
        System.out.println("Különbség: "+(szam1/szam2));
        System.out.println("Maradékos: "+(szam1%szam2));
    }
}
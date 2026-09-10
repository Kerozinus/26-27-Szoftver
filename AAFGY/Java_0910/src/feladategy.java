import java.util.Scanner;
public class feladategy{
    public static void main(String[]args){
        Scanner sc = new Scanner(System.in);

        System.out.print("Adj meg egy számot: ");
        int szam = sc. nextInt();
        if (szam % 2 == 0){
            System.out.print("A megadott számod páros.");
        }
        else{
            System.out.print("A megadott számod páratlan.");
        }
        System.out.print("\nA számod triplája: " + szam*3);
    }
}
